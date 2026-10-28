import { NavLink, Outlet } from 'react-router-dom';

const tab = ({ isActive }) => `whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-ink text-white' : 'text-ink hover:bg-ink/5'}`;

export default function AdminLayout() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-sm text-muted">Administration</p>
      <h1 className="text-2xl font-bold">Marketplace admin</h1>
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-line pb-2" aria-label="Admin">
        <NavLink to="/admin" end className={tab}>Overview</NavLink>
        <NavLink to="/admin/listings" className={tab}>Listings</NavLink>
        <NavLink to="/admin/reports" className={tab}>Reports</NavLink>
        <NavLink to="/admin/sellers" className={tab}>Sellers</NavLink>
        <NavLink to="/admin/plans" className={tab}>Plans and settings</NavLink>
        <NavLink to="/admin/payments" className={tab}>Payments</NavLink>
        <NavLink to="/admin/categories" className={tab}>Categories</NavLink>
        <NavLink to="/admin/localities" className={tab}>Localities</NavLink>
        <NavLink to="/admin/audit" className={tab}>Audit log</NavLink>
      </nav>
      <div className="mt-6"><Outlet /></div>
    </main>
  );
}
