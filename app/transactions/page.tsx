import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createExpense, deleteTransaction } from "@/app/transactions/actions";
import {
  TransactionFilterList,
  type Transaction,
} from "@/app/transactions/_components/transaction-filter-list";
import { BackLink } from "@/app/_components/back-link";
import { SubmitButton } from "@/app/_components/submit-button";

async function getTransactions(): Promise<Transaction[]> {
  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("id, date, type, description, amount, counterparty_name")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const transactions = await getTransactions();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-12">
      <BackLink href="/" />

      <h1 className="mb-6 text-2xl font-medium text-gray-900">Verlauf</h1>

      <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm uppercase tracking-wide text-gray-400">
          Ausgabe erfassen
        </h2>
        <form
          action={createExpense}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex-1">
            <label
              className="mb-1 block text-sm text-gray-600"
              htmlFor="description"
            >
              Beschreibung
            </label>
            <input
              id="description"
              name="description"
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
            />
          </div>
          <div className="w-32">
            <label
              className="mb-1 block text-sm text-gray-600"
              htmlFor="amount"
            >
              Betrag (€)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
            />
          </div>
          <div className="w-40">
            <label
              className="mb-1 block text-sm text-gray-600"
              htmlFor="date"
            >
              Datum
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
            />
          </div>
          <SubmitButton pendingLabel="Speichert…">Speichern</SubmitButton>
        </form>
        {error && <p className="mt-2 text-sm text-gray-500">{error}</p>}
      </section>

      <TransactionFilterList
        transactions={transactions}
        deleteTransaction={deleteTransaction}
      />

      <Link
        href="/"
        className="mt-8 inline-block text-sm text-gray-600 underline underline-offset-4 hover:text-gray-900"
      >
        Zurück zur Startseite
      </Link>
    </main>
  );
}
