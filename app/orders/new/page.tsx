import Link from "next/link";
import { createOrder } from "@/app/orders/actions";
import { getBraceletModels } from "@/lib/bracelet-models";
import { OrderModelPicker } from "@/app/orders/new/_components/order-model-picker";
import { BackLink } from "@/app/_components/back-link";
import { SubmitButton } from "@/app/_components/submit-button";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const models = await getBraceletModels();

  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-12">
      <BackLink href="/" />

      <h1 className="mb-6 text-2xl font-medium text-gray-900">
        Neue Bestellung
      </h1>

      <form action={createOrder} className="space-y-4">
        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="customer_name"
          >
            Name
          </label>
          <input
            id="customer_name"
            name="customer_name"
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <OrderModelPicker models={models} />

        <div>
          <label
            className="mb-1 block text-sm text-gray-600"
            htmlFor="notes"
          >
            Anmerkungen
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        {error && <p className="text-sm text-gray-500">{error}</p>}

        <div className="flex items-center gap-4 pt-2">
          <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
          <Link
            href="/"
            className="text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
          >
            Abbrechen
          </Link>
        </div>
      </form>
    </main>
  );
}
