declare global {
  namespace Express {
    interface Request {
      /** Set by the requireAuth middleware after a valid bearer token. */
      userId?: string;
    }
  }
}

export {};
