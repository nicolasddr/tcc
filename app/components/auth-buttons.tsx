'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, type ButtonOptions } from './ui/button'

const googleButtonClass =
  'inline-flex h-10 cursor-pointer items-center justify-center gap-2.5 rounded-[4px] ' +
  'border border-[#747775] bg-white px-3 font-google text-sm leading-normal ' +
  'font-medium tracking-[0.25px] whitespace-nowrap text-[#1f1f1f] ' +
  'transition-[background-color,box-shadow,border-color] ' +
  'not-disabled:hover:bg-[#f7f8f8] ' +
  'not-disabled:hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.30),0_1px_3px_1px_rgba(60,64,67,0.15)] ' +
  'not-disabled:active:bg-[#f2f3f3] focus-visible:border-[#0b57d0] ' +
  'focus-visible:shadow-[0_0_0_2px_rgba(11,87,208,0.30)] focus-visible:outline-none ' +
  'disabled:cursor-default disabled:opacity-50'

async function signInWithGoogle() {
  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/callback` },
  })
  return error
}

function GoogleLogo() {
  return (
    <svg
      className="block h-[18px] w-[18px] shrink-0"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  )
}

function useGoogleSignIn() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const error = await signInWithGoogle()
    if (error) {
      console.error('Falha ao entrar com o Google:', error.message)
      setLoading(false)
    }
  }

  return { loading, handleClick }
}

export function GoogleSignInButton({
  text = 'Continuar com o Google',
}: {
  text?: string
}) {
  const { loading, handleClick } = useGoogleSignIn()

  return (
    <button
      type="button"
      className={googleButtonClass}
      onClick={handleClick}
      disabled={loading}
      aria-label={text}
    >
      <GoogleLogo />
      <span>{text}</span>
    </button>
  )
}

export function LoginButton({
  children,
  ...options
}: { children: React.ReactNode } & ButtonOptions) {
  const { loading, handleClick } = useGoogleSignIn()

  return (
    <Button {...options} onClick={handleClick} disabled={loading}>
      {children}
    </Button>
  )
}
