import { useEffect, useRef, useState } from 'react';

// Solo interpola la presentación; los valores originales conservan su cálculo.
export default function useAnimatedValues(values, duration = 420) {
  const [displayed, setDisplayed] = useState(() => ({ ...values }));
  const current = useRef(displayed);
  const targetKey = JSON.stringify(values);

  useEffect(() => {
    const target = JSON.parse(targetKey);
    const from = { ...current.current };
    if (Object.keys(target).every(key => from[key] === target[key])) return;

    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let frame;
    const update = next => {
      current.current = next;
      setDisplayed(next);
    };
    const finish = () => {
      window.cancelAnimationFrame(frame);
      update(target);
    };
    if (motion?.matches || duration <= 0) {
      finish();
      return;
    }

    const started = performance.now();
    const tick = timestamp => {
      const progress = Math.min(1, Math.max(0, (timestamp - started) / duration));
      const eased = 1 - (1 - progress) ** 3;
      update(progress === 1 ? target : Object.fromEntries(Object.entries(target)
        .map(([key, value]) => [key, from[key] + (value - from[key]) * eased])));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    const motionChanged = event => { if (event.matches) finish(); };
    motion?.addEventListener('change', motionChanged);
    return () => {
      window.cancelAnimationFrame(frame);
      motion?.removeEventListener('change', motionChanged);
    };
  }, [targetKey, duration]);

  return displayed;
}
