import { cn } from '../../../../utils/cn';

import type { IconProps } from './types';

import './Icon.css';

export function ChatIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0034 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" />
    </svg>
  );
}

export function CommentIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" />
      <path d="M7 8H17" />
      <path d="M7 12H14" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function ChevronUpIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function GitBranchIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

export function CodeIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

export function EditIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3H5C4.46957 3 3.96086 3.21071 3.58579 3.58579C3.21071 3.96086 3 4.46957 3 5V19C3 19.5304 3.21071 20.0391 3.58579 20.4142C3.96086 20.7893 4.46957 21 5 21H19C19.5304 21 20.0391 20.7893 20.4142 20.4142C20.7893 20.0391 21 19.5304 21 19V12" />
      <path d="M18.375 2.625C18.7728 2.22717 19.3124 2.00368 19.875 2.00368C20.4376 2.00368 20.9772 2.22717 21.375 2.625C21.7728 3.02283 21.9963 3.56239 21.9963 4.125C21.9963 4.68761 21.7728 5.22717 21.375 5.625L12 15L8 16L9 12L18.375 2.625Z" />
    </svg>
  );
}

export function FolderIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 19C22 19.5304 21.7893 20.0391 21.4142 20.4142C21.0391 20.7893 20.5304 21 20 21H4C3.46957 21 2.96086 20.7893 2.58579 20.4142C2.21071 20.0391 2 19.5304 2 19V5C2 4.46957 2.21071 3.96086 2.58579 3.58579C2.96086 3.21071 3.46957 3 4 3H9L11 6H20C20.5304 6 21.0391 6.21071 21.4142 6.58579C21.7893 6.96086 22 7.46957 22 8V19Z" />
    </svg>
  );
}

export function ForwardIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M5 4L12 12L5 20" />
      <path d="M13 4L20 12L13 20" />
    </svg>
  );
}

export function SettingsIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4 1.65 1.65 0 0 0 3.5 14H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.18l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 5.6 1.65 1.65 0 0 0 9.5 4H10a2 2 0 1 1 4 0h.09A1.65 1.65 0 0 0 15 5.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.34.31.73.31 1.13V10a2 2 0 1 1 0 4h-.09c-.4 0-.79.11-1.13.31z" />
    </svg>
  );
}

export function MenuIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 6H20" />
      <path d="M4 12H20" />
      <path d="M4 18H20" />
    </svg>
  );
}

export function PencilIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20H8L18.5 9.5C19.0304 8.96957 19.3284 8.24891 19.3284 7.5C19.3284 6.75109 19.0304 6.03043 18.5 5.5C17.9696 4.96957 17.2489 4.67157 16.5 4.67157C15.7511 4.67157 15.0304 4.96957 14.5 5.5L4 16V20Z" />
      <path d="M13.5 6.5L17.5 10.5" />
    </svg>
  );
}

export function PlusIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5V19" />
      <path d="M5 12H19" />
    </svg>
  );
}

export function TerminalIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 7 10 12 4 17" />
      <line x1="12" y1="17" x2="20" y2="17" />
    </svg>
  );
}

export function NotebookIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4H18C18.5304 4 19.0391 4.21071 19.4142 4.58579C19.7893 4.96086 20 5.46957 20 6V18C20 18.5304 19.7893 19.0391 19.4142 19.4142C19.0391 19.7893 18.5304 20 18 20H6C5.46957 20 4.96086 19.7893 4.58579 19.4142C4.21071 19.0391 4 18.5304 4 18V6C4 5.46957 4.21071 4.96086 4.58579 4.58579C4.96086 4.21071 5.46957 4 6 4Z" />
      <path d="M4 8H2" />
      <path d="M4 12H2" />
      <path d="M4 16H2" />
      <path d="M9 9H15" />
      <path d="M9 13H15" />
    </svg>
  );
}

export function RobotIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 2V4" />
      <rect x="4" y="4" width="16" height="12" rx="3" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      <path d="M7 20C7 17.7909 9.23858 16 12 16C14.7614 16 17 17.7909 17 20" />
    </svg>
  );
}

export function SendIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );
}

export function SidebarLeftIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3V21" />
    </svg>
  );
}

export function SidebarRightIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M15 3V21" />
    </svg>
  );
}

export function TrashIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6H5H21" />
      <path d="M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6" />
    </svg>
  );
}

export function ServerIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

export function CheckIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ClockIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export function CloseIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

export function CornerDownRightIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 10 20 15 15 20" />
      <path d="M4 4v7a4 4 0 0 0 4 4h12" />
    </svg>
  );
}

export function SparklesIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3L13.5 8.5L19 10L13.5 11.5L12 17L10.5 11.5L5 10L10.5 8.5L12 3Z" />
      <path d="M19 15L19.88 17.12L22 18L19.88 18.88L19 21L18.12 18.88L16 18L18.12 17.12L19 15Z" />
      <path d="M5 3L5.66 4.84L7.5 5.5L5.66 6.16L5 8L4.34 6.16L2.5 5.5L4.34 4.84L5 3Z" />
    </svg>
  );
}

export function LoaderIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('icon', className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2V6" />
      <path d="M12 18V22" />
      <path d="M4.93 4.93L7.76 7.76" />
      <path d="M16.24 16.24L19.07 19.07" />
      <path d="M2 12H6" />
      <path d="M18 12H22" />
      <path d="M4.93 19.07L7.76 16.24" />
      <path d="M16.24 7.76L19.07 4.93" />
    </svg>
  );
}

/** List/checklist icon for Plan panel */
export function ListIcon({ size = 24, className = '' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('icon', className)}
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export type { IconProps } from './types';
