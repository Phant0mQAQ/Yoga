import Foundation

enum AppRole: String, Codable, CaseIterable, Identifiable {
    case student
    case coach
    case staff

    var id: String { rawValue }

    var titleKey: String {
        switch self {
        case .student: return "Student"
        case .coach: return "Coach"
        case .staff: return "Staff"
        }
    }
}

struct LoginResponse: Codable {
    let token: String
    let session: RoleSession
    let user: User
}

struct RoleSession: Codable {
    let id: String
    let userId: String
    let activeRole: AppRole
    let locale: String
    let createdAt: Date
    let expiresAt: Date
}

struct User: Codable, Identifiable {
    let id: String
    let name: String
    let email: String?
    let phone: String?
    let locale: String
    let roles: [String]
}

struct Course: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let durationMinutes: Int
    let priceAmount: Int
    let currency: String
    let capacity: Int
    let memberCardDeductCount: Int
    let tags: [String]
}

struct Coach: Codable, Identifiable {
    let id: String
    let userId: String
    let name: String
    let age: Int?
    let avatarUrl: String?
    let yearsOfExperience: Int
    let tags: [String]
    let bio: String
}

struct AvailabilitySession: Codable, Identifiable {
    let id: String
    let courseId: String
    let coachId: String
    let startsAt: Date
    let endsAt: Date
    let capacity: Int
    let bookedCount: Int
    let remainingCapacity: Int
    let course: Course?
    let coach: Coach?
}

struct Booking: Codable, Identifiable {
    let id: String
    let userId: String
    let courseId: String
    let courseSessionId: String
    let coachId: String
    let orderId: String?
    let memberCardId: String?
    let status: String
    let startsAt: Date
    let endsAt: Date
    let course: Course?
    let coach: Coach?
    let user: User?
}

struct MemberCard: Codable, Identifiable {
    let id: String
    let userId: String
    let planId: String
    let status: String
    let totalCredits: Int
    let remainingCredits: Int
    let expiresAt: Date
}

struct PaymentMethod: Codable, Identifiable {
    let code: String
    let family: String
    let display: [String: String]
    let flow: String
    let recurring: Bool

    var id: String { code }
}

struct BookingCreateResponse: Codable {
    let booking: Booking
    let order: Order?
}

struct Order: Codable, Identifiable {
    let id: String
    let userId: String
    let status: String
    let totalAmount: Int
    let currency: String
    let paymentId: String?
}
