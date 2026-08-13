import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

export function FadeIn({
  children,
  delay = 0,
  className,
  ...props
}: HTMLMotionProps<"div"> & { delay?: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.45, delay, ease }
      }
      className={className}
      style={{ opacity: 1 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function FadeInStagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08 } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
