import crypto from "crypto";

/**
 * Configuración oficial de Redsys TPV Virtual CaixaBank (Cyberpac)
 */
export const REDSYS_CONFIG = {
  merchantCode: process.env.REDSYS_MERCHANT_CODE || "369845862",
  terminal: process.env.REDSYS_TERMINAL || "1",
  currency: process.env.REDSYS_CURRENCY || "978", // 978 = EUR
  secretKey: process.env.REDSYS_SECRET_KEY || "sq7HjrUOBfKmC576ILgskD5srU870gJ7",
  environment: process.env.REDSYS_ENVIRONMENT || "test",
  url: process.env.REDSYS_URL || "https://sis-t.redsys.es:25443/sis/realizarPago",
  // Feature flag: Permite activar o mantener oculto el TPV mientras se realizan pruebas
  enabled: process.env.NEXT_PUBLIC_ENABLE_REDSYS === "true",
};

/**
 * Genera un identificador de pedido válido para Redsys:
 * - Longitud: 12 caracteres
 * - Los primeros 4 caracteres son numéricos obligatoriamente (YYMM)
 * - Los siguientes 8 caracteres son numéricos aleatorios únicos
 */
export function createRedsysOrder(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const randomPart = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${yy}${mm}${randomPart}`;
}

/**
 * Deriva la clave de cifrado 3DES para el pedido específico:
 * - Algoritmo: DES-EDE3-CBC (Triple DES)
 * - Vector de inicialización (IV): 8 bytes a cero
 */
function encrypt3DES(order: string, secretKeyB64: string): Buffer {
  const key = Buffer.from(secretKeyB64, "base64");
  const iv = Buffer.alloc(8, 0);
  const cipher = crypto.createCipheriv("des-ede3-cbc", key, iv);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(order, "utf8"), cipher.final()]);
}

/**
 * Normaliza cadenas Base64 estándar o URL-safe
 */
export function normalizeBase64(str: string): string {
  return str.replace(/-/g, "+").replace(/_/g, "/");
}

/**
 * Genera la firma HMAC-SHA256 oficial para la petición a Redsys
 */
export function createMerchantSignature({
  secretKey,
  order,
  merchantParamsB64,
}: {
  secretKey: string;
  order: string;
  merchantParamsB64: string;
}): string {
  const orderKey = encrypt3DES(order, secretKey);
  const hmac = crypto.createHmac("sha256", orderKey);
  hmac.update(merchantParamsB64);
  return hmac.digest("base64");
}

/**
 * Decodifica los parámetros de Redsys enviados en Base64
 */
export function decodeMerchantParameters(merchantParamsB64: string): Record<string, any> {
  try {
    const normalized = normalizeBase64(merchantParamsB64);
    const jsonStr = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(jsonStr);
  } catch (err: any) {
    throw new Error(`Error al decodificar Ds_MerchantParameters: ${err.message}`);
  }
}

/**
 * Verifica la firma de una notificación o retorno de Redsys
 */
export function verifyRedsysSignature({
  secretKey,
  merchantParamsB64,
  receivedSignature,
}: {
  secretKey: string;
  merchantParamsB64: string;
  receivedSignature: string;
}): { isValid: boolean; order?: string; params?: Record<string, any>; error?: string } {
  try {
    const params = decodeMerchantParameters(merchantParamsB64);
    const order = params.Ds_Order || params.DS_ORDER || params.Ds_Merchant_Order;

    if (!order) {
      return { isValid: false, error: "No se encontró el número de pedido en los parámetros.", params };
    }

    const calculatedSig = createMerchantSignature({
      secretKey,
      order,
      merchantParamsB64,
    });

    const normReceived = normalizeBase64(receivedSignature).replace(/=+$/, "");
    const normCalculated = normalizeBase64(calculatedSig).replace(/=+$/, "");

    const isValid = normReceived === normCalculated;
    return { isValid, order, params };
  } catch (err: any) {
    return { isValid: false, error: err.message };
  }
}

/**
 * Determina si el código de respuesta de Redsys es de autorización exitosa (0000 a 0099)
 */
export function isRedsysResponseApproved(dsResponse: string | number | undefined): boolean {
  if (dsResponse === undefined || dsResponse === null) return false;
  const num = typeof dsResponse === "string" ? parseInt(dsResponse, 10) : dsResponse;
  return !isNaN(num) && num >= 0 && num <= 99;
}
