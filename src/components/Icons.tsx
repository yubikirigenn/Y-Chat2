import type { PropsWithChildren } from 'react'

type IconProps = {
  className?: string | undefined
}

function BaseIcon({
  className,
  children,
  viewBox = '0 0 24 24',
}: PropsWithChildren<IconProps & { viewBox?: string }>) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  )
}

export function ChatDotsIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 5.5h16v10H9l-5 4v-4H4z" />
      <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
    </BaseIcon>
  )
}

export function PeopleIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M5 19c0-2.2 2.5-4 5-4s5 1.8 5 4" />
      <path d="M4 10.5a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
      <path d="M13 9.8a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0Z" />
      <path d="M16 19c0-1.4 1.4-2.5 3-2.5" />
    </BaseIcon>
  )
}

export function GearIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19 12a7.1 7.1 0 0 0-.1-1l2-1.6-2-3.4-2.4.8a7.8 7.8 0 0 0-1.8-1l-.4-2.5H9.7l-.4 2.5c-.7.3-1.2.6-1.8 1l-2.4-.8-2 3.4 2 1.6a7.1 7.1 0 0 0 0 2L3.1 14.6l2 3.4 2.4-.8c.6.4 1.2.8 1.8 1l.4 2.5h4.6l.4-2.5c.6-.2 1.2-.6 1.8-1l2.4.8 2-3.4-2-1.6c.1-.3.1-.7.1-1Z" />
    </BaseIcon>
  )
}

export function SearchIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="11" cy="11" r="5.5" />
      <path d="m16 16 4 4" />
    </BaseIcon>
  )
}

export function PlusIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </BaseIcon>
  )
}

export function SendIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M4 12 20 4l-4 16-4-7-8-1Z" />
    </BaseIcon>
  )
}

export function BackIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M14 5 7 12l7 7" />
    </BaseIcon>
  )
}

export function PhotoIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="m7 15 3.2-3.2a1.4 1.4 0 0 1 2 0L17 16" />
      <circle cx="10" cy="9" r="1.2" />
    </BaseIcon>
  )
}

export function MoreIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <circle cx="6" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </BaseIcon>
  )
}

export function PinIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M9 3h6l-.8 5.5L17 12l-4 1-1 8-2-8-4-1 2.8-3.5L9 3Z" />
    </BaseIcon>
  )
}

export function BellSlashIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M6 16h12l-1.5-2v-4a4.5 4.5 0 0 0-4.5-4.5 4.7 4.7 0 0 0-1.5.2" />
      <path d="M12 19a1.8 1.8 0 0 0 1.8-1.8h-3.6A1.8 1.8 0 0 0 12 19Z" />
      <path d="m4 4 16 16" />
    </BaseIcon>
  )
}

export function CheckDoubleIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="m5 12 4 4 10-10" />
      <path d="m1 12 4 4 3-3" />
    </BaseIcon>
  )
}

export function CallIcon({ className }: IconProps) {
  return (
    <BaseIcon className={className}>
      <path d="M6 5.5c1.8 0 3.2 1.4 4.1 3l-1.5 1.5c-.2.2-.3.5-.2.8.5 1.3 1.3 2.5 2.3 3.5 1 .9 2.2 1.7 3.5 2.2.3.1.6 0 .8-.2l1.5-1.5c1.6.9 3 2.3 3 4.1 0 1-1 2.1-2.3 2.1-7.8 0-14.1-6.3-14.1-14.1C3.9 6.5 5 5.5 6 5.5Z" />
    </BaseIcon>
  )
}
