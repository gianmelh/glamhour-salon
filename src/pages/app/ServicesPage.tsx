import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, CreateServiceModal, DataSourceNotice, EmptyState, ErrorState, Input, LoadingState, PageTitle, ServiceCard } from '../../components'
import { useServiceCategories, useServices } from '../../hooks/useGlamhourData'
import { serviceCardProps } from '../../lib/view-models'

export function ServicesPage() {
  const services = useServices()
  const categories = useServiceCategories()
  const [open, setOpen] = useState(false)
  if (services.loading) return <LoadingState label="Loading services..." />
  if (!services.data && services.error) return <ErrorState description={services.error.message} onRetry={services.retry} />
  return (
    <div className="space-y-5">
      <DataSourceNotice visible={services.isFallback || categories.isFallback} />
      <PageTitle action={<Button onClick={() => setOpen(true)} size="icon"><Plus className="size-5" /></Button>} title="Services" subtitle="Manage categories, prices, durations, and availability." />
      <Input aria-label="Search services" leadingIcon={<Search className="size-4" />} placeholder="Search services" />
      <div className="flex gap-2 overflow-x-auto pb-1"><Badge tone="primary">All</Badge>{categories.data?.map((category) => <Badge key={category.id}>{category.name}</Badge>)}</div>
      {services.data?.length ? <div className="space-y-3">{services.data.map((service) => <ServiceCard key={service.id} {...serviceCardProps(service)} />)}</div> : <EmptyState description="Create your first salon service." title="No services configured" />}
      <CreateServiceModal categories={categories.data ?? []} onClose={() => setOpen(false)} onCreated={(service) => services.setData((current) => [...(current ?? []), service])} open={open} />
    </div>
  )
}
