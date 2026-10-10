

export default function TrafficLogo({ className = "", size = 32 }: { className?: string, size?: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect x="8" y="2" width="8" height="20" rx="3" />
      <circle cx="12" cy="6" r="1.5" className="text-destructive fill-current opacity-20" />
      <circle cx="12" cy="12" r="1.5" className="text-warning fill-current opacity-20" />
      <circle cx="12" cy="18" r="1.5" className="text-primary fill-current drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      
      {/* Green wave motif lines */}
      <path d="M4 18c-1.5 0-2-1-2-2v-2c0-1.5 1-2 2-2" className="text-primary" strokeDasharray="2 2" />
      <path d="M20 18c1.5 0 2-1 2-2v-2c0-1.5-1-2-2-2" className="text-primary" strokeDasharray="2 2" />
    </svg>
  );
}
