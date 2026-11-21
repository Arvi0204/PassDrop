// Stand-ins for the logins while the vault is frozen: the real ones cannot exist, because the vault key is gone.
const WIDTHS = [[34, 52], [41, 61], [30, 44], [38, 70], [36, 56]];

export default function FrozenRows() {
    return (
        <div className="space-y-2" aria-hidden="true">
            {WIDTHS.map(([title, sub], i) => (
                <div key={i} className="p-3.5 rounded-xl border bg-[#e1eef5]/65 border-white/70 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#d0e4ee] shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-3.5 rounded-md bg-[#d0e4ee]" style={{ width: `${title}%` }} />
                        <div className="h-3 rounded-md bg-[#d0e4ee]" style={{ width: `${sub}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}
