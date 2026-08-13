// Esqueleto instantâneo: aparece na hora ao clicar numa aba, enquanto o
// conteúdo carrega no servidor. A sidebar (layout) permanece fixa.
export default function Loading() {
  return (
    <div className="px-8 py-7 animate-pulse">
      <div className="h-3 w-40 rounded bg-vinho/10" />
      <div className="h-8 w-96 max-w-[70%] rounded-lg bg-vinho/10 mt-3" />
      <div className="h-4 w-[28rem] max-w-[80%] rounded bg-vinho/5 mt-3" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-7">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="glass rounded-2xl h-40" />
        ))}
      </div>
    </div>
  );
}
