export interface ListItemProps {
  icon?: React.ReactNode;
  children: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}
