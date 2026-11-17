interface KiteLogoProps {
  className?: string;
  variant?: 'mark' | 'app';
}

export function KiteLogo({
  className = 'w-6 h-6',
  variant = 'mark',
}: KiteLogoProps) {
  if (variant === 'app') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-white dark:bg-[#202226] border border-[#E6E6E6] dark:border-[#33363D] shadow-sm ${className}`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[70%] h-[70%]"
        >
          <path d="M14.5 2L4.5 12H14.5L19.5 7L14.5 2Z" fill="#FF5722" />
          <path d="M4.5 12L14.5 22L19.5 17L14.5 12H4.5Z" fill="#D63426" />
        </svg>
      </div>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M14.5 2L4.5 12H14.5L19.5 7L14.5 2Z" fill="#FF5722" />
      <path d="M4.5 12L14.5 22L19.5 17L14.5 12H4.5Z" fill="#D63426" />
    </svg>
  );
}
