import Foundation

enum APIEnvironment {
    static let productionBaseURL = URL(
        string: "https://good-vibe-pilates-yoga.2316196563.workers.dev/api/v1/"
    )!

    static var baseURL: URL {
        if
            let configuredValue = Bundle.main.object(
                forInfoDictionaryKey: "GOOD_VIBE_API_BASE_URL"
            ) as? String,
            let configuredURL = normalizedBaseURL(configuredValue)
        {
            return configuredURL
        }

#if DEBUG
        return URL(string: "http://localhost:8080/api/v1/")!
#else
        return productionBaseURL
#endif
    }

    private static func normalizedBaseURL(_ value: String) -> URL? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard
            var components = URLComponents(string: trimmed),
            ["http", "https"].contains(components.scheme?.lowercased()),
            components.host != nil
        else {
            return nil
        }
        if !components.path.hasSuffix("/") {
            components.path += "/"
        }
        return components.url
    }
}

actor APIClient {
    static let shared = APIClient(baseURL: APIEnvironment.baseURL)

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

    func paymentMethods(country: String, currency: String, allSupported: Bool = false) async throws -> [PaymentMethod] {
        let scope = allSupported ? "&scope=all" : ""
        return try await request("/payments/methods?country=\(country)&currency=\(currency)\(scope)", method: "GET", body: Optional<String>.none)
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
        let relativePath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard let url = URL(string: relativePath, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.requestFailed("Invalid API request path")
        }
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
