export function PersonSelect({
  id,
  name = "person",
  required = true,
  className,
}: {
  id: string;
  name?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      required={required}
      defaultValue=""
      className={
        className ??
        "rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-500"
      }
    >
      <option value="" disabled>
        Wählen…
      </option>
      <option value="Carlos">Carlos</option>
      <option value="Leon">Leon</option>
    </select>
  );
}
