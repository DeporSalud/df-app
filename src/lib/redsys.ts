import crypto from "node:crypto";

const TEST_SECRET_KEY = "sq7HjrUOBfKmC576ILgskD5srU870gJ7";
const PROD_SECRET_KEY = "YQX2aqL97CV8lNtHfSGECFvRvPXpj46u";
const PROD_SHA512_KEY = "YQX2aqL97CV8lNtH";
const PROD_API_KEY =
  "PROD_MzY5OTExMTY5XzAwMV9ZUVgyYXFMOTdDVjhsTnRIZlNHRUNGdlJ2UFhwajQ2dQ";
const PROD_REDSYS_URL = "https://sis.redsys.es/sis/realizarPago";

const resolvedSecretKey =
  process.env.REDSYS_SECRET_KEY &&
  process.env.REDSYS_SECRET_KEY !== TEST_SECRET_KEY
    ? process.env.REDSYS_SECRET_KEY
    : PROD_SECRET_KEY;

const resolvedRedsysUrl =
  process.env.REDSYS_URL && !process.env.REDSYS_URL.includes("sis-t.redsys.es")
    ? process.env.REDSYS_URL
    : PROD_REDSYS_URL;

/**
 * Configuración oficial de Redsys TPV Virtual CaixaBank (Cyberpac) - Entorno Real (Producción)
 */
export const REDSYS_CONFIG = {
  merchantCode: process.env.REDSYS_MERCHANT_CODE || "369911169",
  terminal: process.env.REDSYS_TERMINAL || "1",
  currency: process.env.REDSYS_CURRENCY || "978", // 978 = EUR
  secretKey: resolvedSecretKey,
  sha512Key: process.env.REDSYS_SHA512_KEY || PROD_SHA512_KEY,
  apiKey: process.env.REDSYS_API_KEY || PROD_API_KEY,
  environment: "live",
  url: resolvedRedsysUrl,
  enabled: true,
};

/**
 * Añade relleno de ceros (Zero Padding) al buffer hasta un múltiplo del tamaño de bloque (8 bytes para 3DES).
 * Requisito estricto y oficial del protocolo Redsys.
 */
export const zeroPad = (buf: Buffer, blocksize: number = 8): Buffer => {
  const pad = Buffer.alloc(
    (blocksize - (buf.length % blocksize)) % blocksize,
    0
  );
  return Buffer.concat([buf, pad]);
};

/**
 * Cifra el número de pedido usando 3DES (Triple DES en modo CBC con IV a ceros y Zero Padding)
 * Redsys utiliza este método para derivar la clave HMAC única de cada transacción.
 */
export const encrypt3DES = (secretKeyB64: string, message: string): Buffer => {
  const keyBuf = Buffer.from(secretKeyB64, "base64");
  const iv = Buffer.alloc(8, 0);

  const messageBuf = Buffer.from(message.toString(), "utf8");
  // Alinear al tamaño de bloque (8 bytes) mediante relleno de ceros (Zero Padding)
  const paddedMessageBuf = zeroPad(messageBuf, 8);

  const cipher = crypto.createCipheriv("des-ede3-cbc", keyBuf, iv);
  // CRÍTICO: Redsys requiere Zero Padding (\0), NO el relleno PKCS7 por defecto de Node.js.
  // El uso de setAutoPadding(true) causaba el error técnico SIS0042.
  cipher.setAutoPadding(false);

  const encryptedBuf = Buffer.concat([
    cipher.update(paddedMessageBuf),
    cipher.final(),
  ]);

  const maxLength = Math.ceil(messageBuf.length / 8) * 8;
  return encryptedBuf.subarray(0, maxLength);
};

/**
 * Genera la firma HMAC-SHA256 oficial para la petición a Redsys
 */
export const createMerchantSignature = ({
  secretKey,
  order,
  merchantParamsB64,
}: {
  secretKey: string;
  order: string;
  merchantParamsB64: string;
}): string => {
  const orderKeyBuf = encrypt3DES(secretKey, order);
  return crypto
    .createHmac("sha256", orderKeyBuf)
    .update(merchantParamsB64)
    .digest("base64");
};

/**
 * Genera un identificador de pedido válido para Redsys:
 * - Longitud: 12 caracteres numéricos
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
 * Decodifica los parámetros de Redsys enviados en Base64
 */
export function decodeMerchantParameters(merchantParamsB64: string): Record<string, any> {
  try {
    const normalized = merchantParamsB64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(jsonStr);
  } catch (err: any) {
    throw new Error(`Error al decodificar Ds_MerchantParameters: ${err.message}`);
  }
}

/**
 * Normaliza cadenas Base64 estándar o URL-safe
 */
export function normalizeBase64(str: string): string {
  return str.replace(/-/g, "+").replace(/_/g, "/");
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
