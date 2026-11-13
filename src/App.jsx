import { useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Search from './pages/Search.jsx';
import Product from './pages/Product.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Terms from './pages/Terms.jsx';
import RefundPolicy from './pages/RefundPolicy.jsx';
import { AppErrorBoundary, NotFoundPage } from './pages/ErrorPage.jsx';
import SellerLayout from './pages/seller/Layout.jsx';
import SellerListings from './pages/seller/Listings.jsx';
import ListingForm from './pages/seller/ListingForm.jsx';
import Profile from './pages/seller/Profile.jsx';
import Subscription from './pages/seller/Subscription.jsx';
import AdminPlans from './pages/admin/Plans.jsx';
import AdminPayments from './pages/admin/Payments.jsx';
import { ErrorBox } from './components/States.jsx';
import AdminLayout from './pages/admin/Layout.jsx';
import AdminOverview from './pages/admin/Overview.jsx';
import AdminListings from './pages/admin/Listings.jsx';
import AdminListingDetail from './pages/admin/ListingDetail.jsx';
import AdminReports from './pages/admin/Reports.jsx';
import AdminSellers from './pages/admin/Sellers.jsx';
import AdminSellerDetail from './pages/admin/SellerDetail.jsx';
import AdminCategories from './pages/admin/Categories.jsx';
import AdminLocalities from './pages/admin/Localities.jsx';
import AdminAudit from './pages/admin/Audit.jsx';
import { RequireAdmin, RequireAuth, useAuth } from './lib/auth.jsx';
import { useMeta } from './lib/meta.jsx';

function Header() {
  const { cities } = useMeta();
  const { user, logout } = useAuth();
  const [city, setCity] = useState(() => { try { return localStorage.getItem('city') || 'Bengaluru'; } catch { return 'Bengaluru'; } });
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const pick = (c) => { setCity(c); setOpen(false); try { localStorage.setItem('city', c); } catch {} };
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex items-baseline gap-2 leading-none" aria-label="Deadstock Bengaluru, home">
          <span className="font-serif text-[26px] text-ink">Deadstock</span>
        </Link>
        <div className="relative">
          <button className="ml-2 hidden items-center gap-1 rounded-full border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink sm:flex" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>{city} ▾</button>
          {open && (
            <ul role="listbox" className="absolute left-0 mt-1 w-44 rounded-md border border-line bg-white p-1 shadow-sm">
              {cities.map((c) => <li key={c}><button role="option" aria-selected={c === city} className="w-full rounded px-3 py-2 text-left text-sm hover:bg-paper" onClick={() => pick(c)}>{c}</button></li>)}
              <li className="px-3 py-2 text-xs text-muted">More cities are added later.</li>
            </ul>
          )}
        </div>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link to="/search" className="hidden px-3 py-2 text-ink/80 transition-colors hover:text-ink sm:block">Browse materials</Link>
          {user ? (
            <>
              {user.role === 'admin' && <Link to="/admin" className="px-3 py-2 font-semibold text-forest">Admin</Link>}
              <Link to="/dashboard" className="btn btn-outline">Dashboard</Link>
              <button className="px-3 py-2 text-muted hover:text-ink" onClick={async () => { await logout(); nav('/'); }}>Log out</button>
            </>
          ) : (
            <>
              {user === null && <Link to="/login" className="px-3 py-2">Log in</Link>}
              <button className="btn btn-primary rounded-full px-5" onClick={() => nav('/sell')}>Sell<span className="hidden sm:inline">&nbsp;your stock</span></button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
function Footer() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  return (
    <footer className="mt-12 border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 text-sm text-muted sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-serif text-3xl text-ink">Deadstock</p>
          <p className="mt-3 max-w-xs leading-relaxed">Premium building materials below MRP, listed by Bengaluru dealers, manufacturers and contractors. Buyers and sellers deal directly.</p>
        </div>
        <div>
          <p className="eyebrow text-ink">Explore</p>
          <ul className="mt-4 space-y-2">
            <li><Link to="/search" className="hover:text-ink">All materials</Link></li>
            <li><Link to="/sell" className="hover:text-ink">Sell your stock</Link></li>
            {user ? (
              <>
                <li><Link to="/dashboard" className="hover:text-ink">Seller dashboard</Link></li>
                <li><button type="button" className="hover:text-ink" onClick={async () => { await logout(); nav('/'); }}>Log out</button></li>
              </>
            ) : (
              <li><Link to="/login" className="hover:text-ink">Seller log in</Link></li>
            )}
          </ul>
        </div>
        <div>
          <p className="eyebrow text-ink">Company</p>
          <ul className="mt-4 space-y-2">
            <li><Link to="/terms" className="hover:text-ink">Terms &amp; conditions</Link></li>
            <li><Link to="/refund-policy" className="hover:text-ink">Refund policy</Link></li>
            <li className="pt-1 text-xs">Contact: hello@example.com</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
function Sell() {
  const { user } = useAuth();
  const { pricing } = useMeta();
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="serif-title text-5xl">Sell your surplus stock</h1>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-muted">
        <li>Create a seller account and verify your mobile number. Your free {pricing?.trialDays || 30}-day trial starts then.</li>
        <li>List as many products as you like, with photos of the actual stock. There's no fee per listing.</li>
        <li>Listings are checked automatically and go live as soon as you submit. A few are held for a quick check by our team.</li>
        <li>Keep listing with an annual plan{pricing?.fromPrice ? ` from ₹${pricing.fromPrice.toLocaleString('en-IN')} a year` : ''}, sized by storage. Buyers call or WhatsApp you directly. No commission on your sales.</li>
      </ol>
      <div className="mt-6 flex gap-2"><Link to="/register" className="btn btn-primary">Create seller account</Link><Link to="/login" className="btn btn-outline">Log in</Link></div>
    </main>
  );
}
export default function App() {
  const meta = useMeta();
  return (
    <>
      <div className="bg-night px-4 py-1.5 text-center text-[11px] tracking-wide text-white/70">Preview build. Listings marked “sample” are demonstration data.</div>
      <Header />
      {meta.error && <div className="mx-auto max-w-6xl px-4 pt-4"><ErrorBox message={meta.error} onRetry={meta.reload} /></div>}
      <AppErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/product/:id" element={<Product />} />
          <Route path="/sell" element={<Sell />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/dashboard" element={<RequireAuth><SellerLayout /></RequireAuth>}>
            <Route index element={<SellerListings />} />
            <Route path="listings/new" element={<ListingForm />} />
            <Route path="listings/:id/edit" element={<ListingForm key="edit" />} />
            <Route path="profile" element={<Profile />} />
            <Route path="subscription" element={<Subscription />} />
          </Route>
          <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
            <Route index element={<AdminOverview />} />
            <Route path="listings" element={<AdminListings />} />
            <Route path="listings/:id" element={<AdminListingDetail />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="sellers" element={<AdminSellers />} />
            <Route path="sellers/:id" element={<AdminSellerDetail />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="localities" element={<AdminLocalities />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="plans" element={<AdminPlans />} />
            <Route path="payments" element={<AdminPayments />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppErrorBoundary>
      <Footer />
    </>
  );
}
