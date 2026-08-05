import { GoogleSignInButton } from '@/app/components/auth-buttons'
import { Card } from '@/app/components/ui/card'

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-canvas px-6 py-16">
      <Card padding="lg" className="w-full max-w-[380px] text-center">
        <h1 className="text-[22px] font-bold text-ink">Engenharia de Prompt</h1>
        <p className="mt-2 mb-6 text-sm text-muted">
          Entre com sua conta Google para acessar seus projetos.
        </p>
        <div className="flex justify-center">
          <GoogleSignInButton />
        </div>
      </Card>
    </div>
  )
}
