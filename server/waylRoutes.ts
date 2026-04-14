import type { Express } from "express";
import * as admin from "firebase-admin";
import {
  mapWaylException,
  WaylService,
  type WaylCustomerDetails,
} from "./waylService.ts";
import { ensureFirebaseAdminApp, isWalletFirestoreConfigured } from "./walletFirestore.ts";

type CreateWaylCheckoutBody = {
  amount?: number;
  description?: string;
  customer_details?: WaylCustomerDetails;
  currency?: string;
  success_url?: string;
  failure_url?: string;
  cancel_url?: string;
  bookingId?: string;
  metadata?: Record<string, unknown>;
};

export function registerWaylRoutes(app: Express): void {
  app.get("/api/payments/wayl/verify-key", async (_req, res) => {
    try {
      const wayl = new WaylService();
      const result = await wayl.verifyKey();
      return res.json(result);
    } catch (error: unknown) {
      const mapped = mapWaylException(error);
      return res.status(mapped.status).json({
        message: mapped.message,
        details: mapped.details,
      });
    }
  });

  app.post("/api/payments/wayl/checkout-session", async (req, res) => {
    try {
      console.log("[Wayl] checkout-session body:", JSON.stringify(req.body ?? {}));
      const body = req.body as CreateWaylCheckoutBody;
      console.log("FINAL AMOUNT RECEIVED:", Number(body.amount));
      const bookingId = String(body.bookingId ?? body.metadata?.bookingId ?? "").trim();
      if (!bookingId) {
        return res.status(400).json({
          message: "bookingId is required (body.bookingId or metadata.bookingId)",
        });
      }

      const origin = String(req.headers.origin ?? "").trim();
      const webBase =
        origin ||
        process.env.EXPO_PUBLIC_API_URL?.trim() ||
        process.env.WEB_APP_URL?.trim() ||
        "";
      const webSuccessUrl = webBase
        ? `${webBase.replace(/\/$/, "")}/payment/result?status=success`
        : "";
      const webFailureUrl = webBase
        ? `${webBase.replace(/\/$/, "")}/payment/result?status=failure`
        : "";
      const defaultSuccessUrl = webSuccessUrl || "shootha://payment/result?status=success";
      const defaultFailureUrl = webFailureUrl || "shootha://payment/result?status=failure";
      const successUrl = String(
        body.success_url ?? process.env.WAYL_SUCCESS_URL ?? defaultSuccessUrl,
      ).trim();
      const failureUrl = String(
        body.failure_url ??
          body.cancel_url ??
          process.env.WAYL_FAILURE_URL ??
          process.env.WAYL_CANCEL_URL ??
          defaultFailureUrl,
      ).trim();

      const metadata: Record<string, unknown> = {
        ...(body.metadata ?? {}),
        bookingId,
      };
      const wayl = new WaylService();
      const session = await wayl.createCheckoutSession({
        amount: Number(body.amount),
        description: String(body.description ?? ""),
        customer_details: (body.customer_details ?? {}) as WaylCustomerDetails,
        currency: body.currency || "IQD",
        success_url: successUrl,
        failure_url: failureUrl,
        cancel_url: failureUrl,
        metadata,
      });
      console.log("[Wayl] checkout-session OK:", {
        checkoutUrl: session.checkoutUrl?.slice(0, 80),
      });
      return res.status(201).json({
        checkoutUrl: session.checkoutUrl,
      });
    } catch (error: unknown) {
      console.error("[Wayl] checkout-session route error:", error);
      const mapped = mapWaylException(error);
      return res.status(mapped.status).json({
        message: mapped.message,
        details: mapped.details,
      });
    }
  });

  app.post("/api/payments/wayl/validate-transaction", async (req, res) => {
    try {
      const body = req.body as { transactionId?: string };
      const wayl = new WaylService();
      const result = await wayl.validateTransaction(String(body.transactionId ?? ""));
      return res.json(result);
    } catch (error: unknown) {
      const mapped = mapWaylException(error);
      return res.status(mapped.status).json({
        message: mapped.message,
        details: mapped.details,
      });
    }
  });

  app.post("/api/payments/wayl/webhook", async (req, res) => {
    const payload = (req.body ?? {}) as Record<string, unknown>;
    try {
      const statusRaw = String(payload.status ?? payload.paymentStatus ?? "").trim().toLowerCase();
      if (statusRaw !== "approved") {
        return res.status(200).send("OK");
      }

      const metadataObj =
        payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
          ? (payload.metadata as Record<string, unknown>)
          : undefined;

      const customParameterObj = (() => {
        const raw = payload.customParameter;
        if (typeof raw !== "string" || !raw.trim()) return undefined;
        try {
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : undefined;
        } catch {
          return undefined;
        }
      })();

      const bookingId = String(
        metadataObj?.bookingId ?? customParameterObj?.bookingId ?? payload.bookingId ?? "",
      ).trim();
      if (!bookingId) {
        return res.status(200).send("OK");
      }

      if (!isWalletFirestoreConfigured()) {
        return res.status(200).send("OK");
      }

      ensureFirebaseAdminApp();
      const db = admin.firestore();

      const txId = String(
        payload.transactionId ??
          payload.transaction_id ??
          payload.id ??
          payload.referenceId ??
          payload.reference_id ??
          "",
      ).trim();

      await db.collection("bookings").doc(bookingId).set(
        {
          status: "confirmed",
          paymentStatus: "paid",
          waylTransactionId: txId || null,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      return res.status(200).send("OK");
    } catch (error) {
      console.error("Wayl webhook processing error:", error);
      return res.status(200).send("OK");
    }
  });
}
