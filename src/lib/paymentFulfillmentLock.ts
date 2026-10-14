import { calculateBonoExpirationDate } from "@/lib/matriculaService";
import { getEndOfDayMadrid } from "@/lib/timezones";

interface FulfillmentRecord {
  timestamp: number;
  result: any;
}

const activeLocks = new Map<string, Promise<any>>();
const completedFulfillments = new Map<string, FulfillmentRecord>();

/**
 * Garantiza ejecución exclusiva e idempotente para una misma transacción de pasarela
 * (Stripe sessionId/paymentIntentId o Redsys Ds_Order) cuando el Webhook y el retorno
 * del navegador (verify-session / verify-order) llegan simultáneamente.
 */
export async function withPaymentFulfillmentLock<T>(
  txKey: string,
  fn: () => Promise<T>
): Promise<{ alreadyFulfilled: boolean; result: T }> {
  const normalizedKey = txKey.trim();

  const existingCompleted = completedFulfillments.get(normalizedKey);
  if (existingCompleted) {
    return { alreadyFulfilled: true, result: existingCompleted.result as T };
  }

  const inFlight = activeLocks.get(normalizedKey);
  if (inFlight) {
    const result = await inFlight;
    return { alreadyFulfilled: true, result: result as T };
  }

  const executionPromise = (async () => {
    try {
      const res = await fn();
      completedFulfillments.set(normalizedKey, {
        timestamp: Date.now(),
        result: res,
      });
      return res;
    } finally {
      activeLocks.delete(normalizedKey);
    }
  })();

  activeLocks.set(normalizedKey, executionPromise);
  const result = await executionPromise;
  return { alreadyFulfilled: false, result };
}

/**
 * Calcula el nuevo saldo de clases de un bono respetando las clases vigentes no caducadas
 * y descartando saldos residuales de bonos ya caducados en zona horaria Europe/Madrid.
 */
export function computeNewBonoBalance(
  student: {
    id?: string;
    plan_activo?: string | null;
    clases_restantes?: number | null;
    creado_en?: string | null;
    bono_caducidad?: string | null;
  } | null,
  addedClasses: number
): { validPriorBalance: number; updatedBalance: number; wasExpired: boolean } {
  const isUnlimited = addedClasses >= 999;
  if (isUnlimited) {
    return { validPriorBalance: 0, updatedBalance: 999, wasExpired: false };
  }

  const rawBalance =
    student && typeof student.clases_restantes === "number" && student.clases_restantes > 0
      ? student.clases_restantes
      : 0;

  if (!student || rawBalance <= 0) {
    return { validPriorBalance: 0, updatedBalance: addedClasses, wasExpired: false };
  }

  let expDate: Date | null = null;
  if (student.bono_caducidad) {
    const parsed = new Date(student.bono_caducidad);
    if (!isNaN(parsed.getTime())) {
      expDate = getEndOfDayMadrid(parsed);
    }
  }
  if (!expDate) {
    expDate = calculateBonoExpirationDate(
      student.plan_activo,
      student.creado_en,
      undefined,
      student.id
    );
  }

  const isExpired = expDate ? new Date() > getEndOfDayMadrid(expDate) : false;
  const validPriorBalance = isExpired ? 0 : rawBalance;
  const updatedBalance = validPriorBalance + addedClasses;

  return {
    validPriorBalance,
    updatedBalance,
    wasExpired: isExpired,
  };
}
