import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseAdmin } from '../../lib/supabase-server'
import { AdminSidebar } from '../../src/components/AdminSidebar'

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // Use service-role client to bypass RLS when checking is_admin
  const { data: creator } = await getSupabaseAdmin().from('creators').select('is_admin').eq('id', user.id).single()
  if (!creator?.is_admin) redirect('/dashboard')

  return (
    <div className="flex min-h-screen bg-bg">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto px-4 py-6 pt-20 lg:px-8 lg:py-8 lg:pt-8">
        {children}
      </main>
    </div>
  )
}
