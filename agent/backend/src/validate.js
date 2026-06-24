import { z } from "zod";

/**
 * Validates the Agent Signup request.
 * Frontend must send: { fullName, mobile, password }
 */
export const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(160),
  mobile: z.string().trim().min(6, "Mobile number must be at least 6 digits").max(32),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

/**
 * Validates the Agent Login request.
 * Frontend must send: { mobile, password }
 */
export const loginSchema = z.object({
  mobile: z.string().trim().min(1, "Mobile number or Agent ID is required").max(32),
  password: z.string().min(1, "Password is required").max(128),
});

/**
 * Validates the KYC Submission.
 * Uses preprocess to handle boolean strings sent via multipart/form-data.
 */
export const kycSchema = z.object({
  // Basic Info
  fullName: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email format").optional().or(z.literal('')),
  phone: z.string().trim().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),

  // Identity
  idType: z.string().optional(),
  idNumber: z.string().optional(),

  // Address
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),

  // Bank Details
  accountName: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  branchName: z.string().optional(),

  // Vehicle Info
  vehicleType: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehicleColor: z.string().optional(),
  licensePlate: z.string().optional(),
  registrationNumber: z.string().optional(),

  // Emergency Contact
  emergencyName: z.string().optional(),
  emergencyRelation: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyAltPhone: z.string().optional(),
  emergencyEmail: z.string().optional(),
  emergencyAddress: z.string().optional(),

  // Consent & Agreements 
  // Preprocess converts string "true"/"false" from FormData into actual booleans
  confirmAccuracy: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  agreeTerms: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  agreePrivacy: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  agreeCommunications: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});