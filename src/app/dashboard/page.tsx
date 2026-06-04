import Dashboard from '@/components/Dashboard'
import dataJson from '../../../public/data.json'

export default function DashboardPage() {
  return <Dashboard data={dataJson as any} />
}
