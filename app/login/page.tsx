'use client'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
    const supabase = createClient()

    async function entrarComGoogle() {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo:
            `${location.origin}/auth/callback` },
        })
    }

    return <button onClick={entrarComGoogle}>Entrar com Google</button>

}