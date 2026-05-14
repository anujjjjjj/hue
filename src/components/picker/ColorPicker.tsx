import type { HSB } from '../../lib/color';
import { HueRing } from './HueRing';
import { SBPad } from './SBPad';
import { MonoLabel } from '../ui/MonoLabel';

interface ColorPickerProps {
  value: HSB;
  onChange: (value: HSB) => void;
}

/**
 * The v1 picker: hue ring + canvas-rendered SB pad + numeric readout, all
 * reflecting and controlling one shared HSB value. Structured so alternate
 * input modes (sliders, 3D cylinder) could be swapped in later without
 * touching the consuming phase.
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center sm:gap-9">
      <HueRing
        hue={value.h}
        onChange={(h) => onChange({ ...value, h })}
        size={180}
      />
      <SBPad
        hue={value.h}
        s={value.s}
        b={value.b}
        onChange={(s, b) => onChange({ ...value, s, b })}
        width={200}
        height={180}
      />
      <Readout value={value} />
    </div>
  );
}

function Readout({ value }: { value: HSB }) {
  const rows: Array<[string, string]> = [
    ['H', `${Math.round(value.h)}°`],
    ['S', `${Math.round(value.s)}%`],
    ['B', `${Math.round(value.b)}%`],
  ];
  return (
    <div className="flex flex-row gap-5 sm:flex-col sm:gap-3">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline gap-2">
          <MonoLabel className="text-dimmer">{k}</MonoLabel>
          <span className="font-mono text-[15px] tabular-nums text-fg">
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}
