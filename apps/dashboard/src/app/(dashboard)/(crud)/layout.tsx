import Breadcrumbs from "@/components/Breadcrumbs";

export default function CrudLayout({ children }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full w-full pb-36 lg:pb-6">
      <Breadcrumbs />
      {children}
    </div>
  )
}