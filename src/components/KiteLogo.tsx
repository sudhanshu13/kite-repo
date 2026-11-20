const KITE_LOGO_URL = 'https://kite.zerodha.com/static/images/kite-logo.svg';

interface KiteLogoProps {
  className?: string;
  variant?: 'mark' | 'app';
}

export function KiteLogo({
  className = 'h-5 w-auto',
  variant = 'mark',
}: KiteLogoProps) {
  if (variant === 'app') {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-xl bg-white dark:bg-[#202226] border border-[#E6E6E6] dark:border-[#33363D] shadow-sm p-2.5 ${className}`}
      >
        <img
          src={KITE_LOGO_URL}
          alt="Trading logo"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <img
      src={KITE_LOGO_URL}
      alt="Trading logo"
      className={`object-contain ${className}`}
    />
  );
}
