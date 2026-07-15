// Ambient module shims for optional test dependencies. These are
// declared in a .d.ts file (not imported in any code path) so type-
// checking succeeds in environments where the dependency is not
// installed. The vitest include list in vitest.config.ts gates whether
// these shims are ever actually needed at runtime.

declare module "@testing-library/react" {
  export function render(ui: unknown): { container: HTMLElement };
  export const act: (cb: () => void | Promise<void>) => Promise<void>;
  export const screen: { getByText(pattern: RegExp): HTMLElement; queryByText(pattern: RegExp): HTMLElement | null };
  export function cleanup(): void;
}
