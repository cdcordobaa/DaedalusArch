// NM-IO4: a project function named `fetch` shadows the global; calling it is not I/O.
function fetch(): number {
  return 1;
}
export const fetchCount = (): number => fetch();
