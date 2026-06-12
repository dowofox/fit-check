export const colors = {
  background: "#F7F2EB",
  card: "#FFFFFF",
  text: "#111111",
  subText: "#777064",
  point: "#8C6F47",
  warning: "#B45309",
  softCard: "#F4EEE7",
  inactiveTab: "#EFE8DE",
  border: "#E8DED2",
};

export const radius = {
  sm: 14,
  md: 18,
  lg: 22,
  xl: 24,
  round: 999,
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
};

export const shadow = {
  subtle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
};

export const typography = {
  eyebrow: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1.3,
  },
  title: {
    fontSize: 26,
    fontWeight: "800" as const,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 14,
    fontWeight: "500" as const,
    lineHeight: 21,
  },
};
