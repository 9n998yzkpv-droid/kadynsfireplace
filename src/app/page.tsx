import Dashboard from '@/components/Dashboard'
import dataJson from '../../public/data.json'

export default function HomePage() {
  return <Dashboard data={dataJson as any} />
}
