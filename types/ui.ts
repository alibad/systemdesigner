import { type VariantProps } from "class-variance-authority"
import { buttonVariants } from "@/components/ui/button"

// Button types
export type ButtonVariant = VariantProps<typeof buttonVariants>['variant']
export type ButtonSize = VariantProps<typeof buttonVariants>['size']

// Form field types
export interface FormFieldProps {
  label?: string
  error?: string
  required?: boolean
  helperText?: string
}

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

// Modal/Dialog types
export interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}

// Common component props
export interface BaseComponentProps {
  className?: string
  id?: string
  'data-testid'?: string
}

// Layout types
export interface SpacingProps {
  m?: number | string
  mt?: number | string
  mr?: number | string
  mb?: number | string
  ml?: number | string
  mx?: number | string
  my?: number | string
  p?: number | string
  pt?: number | string
  pr?: number | string
  pb?: number | string
  pl?: number | string
  px?: number | string
  py?: number | string
}

// Color system types
export type ColorScheme = 'primary' | 'secondary' | 'destructive' | 'muted' | 'accent'
export type ColorVariant = 'default' | 'subtle' | 'outline' | 'ghost'

// Loading states
export interface LoadingState {
  isLoading: boolean
  loadingText?: string
}

// Feedback types
export type FeedbackCategory = 'general' | 'bug' | 'feature' | 'content' | 'ui'

export interface FeedbackFormData {
  feedback: string
  category: FeedbackCategory
  url?: string
  userAgent?: string
}

export interface FeedbackSubmission extends FeedbackFormData {
  userId?: string | null
  userEmail?: string | null
  userName?: string | null
  userPhotoURL?: string | null
  isAnonymous?: boolean
  timestamp: Date
}