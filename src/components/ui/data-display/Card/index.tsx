import './Card.css';

import type { CardProps } from './types';

export function Card({
  children,
  width,
  height,
  radius = 'md',
  shadow = false,
  bordered = true,
  borderWidth = 'thin',
  background = 'elevated',
  padding = 'md',
  className = '',
  style,
  onClick,
}: CardProps) {
  const classNames = [
    'card',
    `card--padding-${padding}`,
    `card--radius-${radius}`,
    `card--bg-${background}`,
    shadow && 'card--shadow',
    bordered && `card--bordered card--border-${borderWidth}`,
    onClick && 'card--clickable',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const cardStyle: React.CSSProperties = {
    ...style,
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div className={classNames} style={cardStyle} onClick={onClick}>
      {children}
    </div>
  );
}

export type { CardProps, BorderWidth, BackgroundColor } from './types';
