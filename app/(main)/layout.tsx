import Nav from '@/components/Nav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main>{children}</main>
    </>
  )
}
