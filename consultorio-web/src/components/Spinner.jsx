export default function Spinner({ text = "Carregando..." }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-4 border-gray-300 border-t-yellow-400 rounded-full animate-spin"></div>
      <p className="text-gray-700">{text}</p>
    </div>
  );
}
