import { Logo } from './Logo';
import { Settings } from './Settings';

export function Nav() {
  return (
    <nav className="flex items-center justify-between px-6 py-5 sm:px-8">
      <Logo />
      <Settings />
    </nav>
  );
}
