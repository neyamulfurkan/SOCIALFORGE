import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import DashboardShell from '@/components/dashboard/DashboardShell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const cookieStore = await cookies();
  const impersonationToken = cookieStore.get('impersonation_token');
  const impersonatingBusinessId = cookieStore.get('impersonating_business_id');
  const isImpersonating = !!(impersonationToken?.value && impersonatingBusinessId?.value);

  let businessName = 'My Store';

  if (session.user.role === 'BUSINESS_OWNER' && session.user.businessId) {
    const business = await prisma.business.findUnique({
      where: { id: session.user.businessId },
      select: { name: true, status: true },
    });

    if (!business) redirect('/login');

    if (business.status === 'SUSPENDED') {
      return (
        <div className="min-h-screen bg-base flex items-center justify-center">
          <div className="bg-surface rounded-xl p-8 max-w-md text-center">
            <h1 className="text-xl font-bold mb-2">Account Suspended</h1>
            <p className="text-text-secondary">
              Your account has been suspended. Please contact support.
            </p>
          </div>
        </div>
      );
    }

    businessName = business.name;
  }

  if (session.user.role === 'SUPER_ADMIN' && isImpersonating && impersonatingBusinessId?.value) {
    const impersonatedBusiness = await prisma.business.findUnique({
      where: { id: impersonatingBusinessId.value },
      select: { name: true },
    });
    if (impersonatedBusiness) {
      businessName = impersonatedBusiness.name;
    }
  }

  return (
    <DashboardShell
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        businessId: session.user.businessId ?? null,
      }}
      businessName={businessName}
      isImpersonating={isImpersonating}
    >
      {children}
    </DashboardShell>
  );
}