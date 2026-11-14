import type { Chassis } from '../../game/progression/cosmetics.ts';

interface Props {
  chassis: Chassis;
  primary: string;
  secondary: string;
  size?: number | string;
  class?: string;
  locked?: boolean;
}

const INK: Record<string, string> = { k: '#070a14', w: '#ffffff' };

/**
 * SVG rendition of a chassis, generated from the same part list the WebGL
 * renderer uses, so menus and gameplay can never disagree.
 */
export function ChassisIcon({ chassis, primary, secondary, size = 64, class: cls, locked }: Props) {
  const col = (c: string) => (c === 'p' ? primary : c === 's' ? secondary : INK[c]);
  return (
    <svg class={cls} width={size} height={size} viewBox="-0.62 -0.62 1.24 1.24" aria-hidden="true"
      style={locked ? { opacity: 0.4, filter: 'grayscale(1)' } : undefined}>
      <g transform="scale(1,-1)">
        {chassis.hollow
          ? <rect x={-0.45} y={-0.45} width={0.9} height={0.9} rx={0.07} fill={primary} fill-opacity={0.1} stroke={primary} stroke-width={0.1} />
          : <rect x={-0.5} y={-0.5} width={1} height={1} rx={0.1} fill={primary} stroke="#ffffff" stroke-opacity={0.55} stroke-width={0.05}
              style={{ paintOrder: 'fill' }} />}
        {chassis.parts.map((p, i) => {
          const fill = col(p.color);
          const hw = p.w / 2, hh = p.h / 2;
          switch (p.shape) {
            case 'circle':
              return <circle key={i} cx={p.x} cy={p.y} r={hw} fill={fill} />;
            case 'tri':
              return <polygon key={i} points={`${p.x},${p.y + hh} ${p.x - hw},${p.y - hh} ${p.x + hw},${p.y - hh}`} fill={fill} />;
            case 'diamond':
              return <polygon key={i} points={`${p.x},${p.y + hh} ${p.x + hw},${p.y} ${p.x},${p.y - hh} ${p.x - hw},${p.y}`} fill={fill} />;
            default:
              return <rect key={i} x={p.x - hw} y={p.y - hh} width={p.w} height={p.h} rx={p.radius ?? 0} fill={fill} />;
          }
        })}
      </g>
    </svg>
  );
}
