import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-screen text-foreground font-sans transition-colors duration-300">
      <Navbar />
      <div className="flex overflow-hidden bg-background pt-14">
        <Sidebar />
        <div className="bg-background relative w-full h-full overflow-y-auto lg:ml-64 p-6 lg:p-10 min-h-[calc(100vh-56px)]">
          <main className="max-w-7xl mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
