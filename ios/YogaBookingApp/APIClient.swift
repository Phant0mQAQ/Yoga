import Foundation

actor APIClient {
    static let shared = APIClient(baseURL: URL(string: "http://localhost:8080/api/v1")!)

    private let baseURL: URL
    private var token: String?

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    init(baseURL: URL) {
        self.baseURL = baseURL
    }

    func setToken(_ token: String?) {
        self.token = token
    }

    func login(email: String, password: String, role: AppRole, locale: String) async throws -> LoginResponse {
        let body = [
            "email": email,
            "password": password,
            "role": role.rawValue,
            "locale": locale
        ]
        let response: LoginResponse = try await request("/auth/login", method: "POST", body: body)
        token = response.token
        return response
    }

    func logout() async throws {
        let _: EmptyResponse = try await request("/auth/logout", method: "POST", body: Optional<String>.none)
        token = nil
    }

    func availability(locale: String) async throws -> [AvailabilitySession] {
        try await request("/availability?locale=\(locale)", method: "GET", body: Optional<String>.none)
    }

    func bookings(locale: String) async throws -> [Booking] {
        try await request("/bookings?locale=\(locale)", method: "GET", body: Optional<String>.none)
    }

    func memberCards() async throws -> [MemberCard] {
        try await request("/member-cards", method: "GET", body: Optional<String>.none)
    }

    func paymentMethods(country: String, currency: String) async throws -> [PaymentMethod] {
        try await request("/payments/methods?country=\(country)&currency=\(currency)", method: "GET", body: Optional<String>.none)
    }

    func createBooking(courseSessionId: String, paymentMode: String) async throws -> BookingCreateResponse {
        let body = ["courseSessionId": courseSessionId, "paymentMode": paymentMode]
        return try await request("/bookings", method: "POST", body: body, idempotencyKey: UUID().uuidString)
    }

    func checkIn(bookingId: String) async throws {
        let body = ["method": "manual"]
        let _: EmptyResponse = try await request("/bookings/\(bookingId)/check-in", method: "POST", body: body)
    }

    private func request<Response: Decodable, Body: Encodable>(
        _ path: String,
        method: String,
        body: Body?,
        idempotencyKey: String? = nil
    ) async throws -> Response {
        let url = URL(string: path, relativeTo: baseURL)!
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let idempotencyKey {
            request.setValue(idempotencyKey, forHTTPHeaderField: "Idempotency-Key")
        }
        if let body {
            request.httpBody = try encoder.encode(body)
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw APIError.requestFailed(String(data: data, encoding: .utf8) ?? "Request failed")
        }
        if data.isEmpty {
            return EmptyResponse() as! Response
        }
        return try decoder.decode(Response.self, from: data)
    }
}

struct EmptyResponse: Codable {}

enum APIError: Error {
    case requestFailed(String)
}
