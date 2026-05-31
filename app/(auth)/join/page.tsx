// @ts-nocheck
import { redirect } from 'next/navigation'

// The join flow has been replaced by the multi-step onboarding flow.
export default function JoinPage() {
  redirect('/onboarding')
}
