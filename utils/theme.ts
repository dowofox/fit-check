export const colors = {
  background: "#F4F1EA",
  card: "#FFFFFF",
  text: "#17221E",
  subText: "#6C756F",
  point: "#194C3D",
  warning: "#D05D45",
  softCard: "#E9EEE9",
  inactiveTab: "#EDF1EE",
  border: "#D7DDD7",
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 20,
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
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
};

export const typography = {
  eyebrow: {
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 1.3,
  },
  title: {
    fontSize: 24,
    fontWeight: "800" as const,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 14,
    fontWeight: "500" as const,
    lineHeight: 21,
  },
};
