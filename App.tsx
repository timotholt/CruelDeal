
import { createSignal } from 'solid-js';

function App() {
  const [count, setCount] = createSignal(0);

  return (
    <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-white font-sans p-8">
      <h1 class="text-4xl font-bold mb-4 text-indigo-400">Galactic Snap: SolidJS Edition</h1>
      <p class="text-xl mb-8 opacity-80">Phase 1: Environment & Foundation Successful</p>
      
      <div class="bg-slate-900 p-6 rounded-xl border border-indigo-500/30 flex flex-col items-center shadow-2xl">
        <span class="text-6xl font-mono mb-4">{count()}</span>
        <button 
          onClick={() => setCount(count() + 1)}
          class="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
        >
          Increment Reactive Signal
        </button>
      </div>

      <div class="mt-12 text-sm text-slate-500">
        Ready for Phase 2: Reactive State Layer
      </div>
    </div>
  );
}

export default App;
