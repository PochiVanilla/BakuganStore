import type { BlogPost } from '@/types';
import { blogPlaceholder } from '@/utils/placeholder';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (days: number): string => new Date(now - days * DAY).toISOString();

export const BLOG_CATEGORIES = ['Hướng dẫn', 'Sưu tầm', 'Đấu giá', 'Tin shop', 'Review'] as const;

export const MOCK_BLOG_POSTS: BlogPost[] = [
  {
    id: 'post-001',
    slug: 'cach-phan-biet-bakugan-that-va-hang-nhai',
    title: 'Cách phân biệt Bakugan chính hãng và hàng nhái chỉ trong 5 phút',
    excerpt:
      'Nam châm yếu, khớp bung nở lỏng, nhãn in mờ — ba dấu hiệu dễ nhận ra nhất khi bạn cầm một quả Bakugan không rõ nguồn gốc.',
    coverImage: blogPlaceholder('Phan biet Bakugan that', 0),
    category: 'Hướng dẫn',
    tags: ['chính hãng', 'kiểm tra', 'người mới'],
    authorName: 'TD Bakugan Team',
    publishedAt: daysAgo(3),
    readingMinutes: 7,
    viewCount: 4_820,
    sections: [
      {
        paragraphs: [
          'Thị trường Bakugan tại Việt Nam vài năm gần đây sôi động trở lại, kéo theo không ít hàng nhái được bán với giá gần bằng hàng thật. Bài viết này tổng hợp những gì đội ngũ TD Bakugan kiểm tra mỗi khi nhập một lô hàng mới.',
        ],
      },
      {
        heading: '1. Thử lực nam châm',
        paragraphs: [
          'Hàng chính hãng dùng nam châm neodymium, khi đặt gần thẻ bài kim loại sẽ hút dứt khoát và bung nở ngay lập tức. Hàng nhái thường dùng nam châm ferrite rẻ tiền: bạn phải đặt rất sát, đôi khi phải lắc nhẹ mới bung.',
        ],
        bullets: [
          'Đặt Bakugan cách thẻ bài khoảng 1cm — hàng thật sẽ tự hút vào.',
          'Bung nở phải xảy ra trong dưới một giây, có tiếng "tách" rõ.',
          'Thử 5–10 lần liên tiếp, cơ cấu không được kẹt hay bung nửa chừng.',
        ],
      },
      {
        heading: '2. Kiểm tra đường ghép nhựa',
        paragraphs: [
          'Khuôn ép của hàng chính hãng rất kín, đường ghép giữa hai nửa vỏ gần như không cấn tay. Hàng nhái thường có ba-via nhựa thừa, sờ vào thấy gợn, đôi khi còn lộ cả vết keo.',
        ],
      },
      {
        heading: '3. Đọc kỹ nhãn và mã series',
        paragraphs: [
          'Mỗi quả Bakugan chính hãng đều có mã series dập chìm ở mặt dưới. Mã này phải sắc nét, không nhoè. Nếu mã bị mờ hoặc in nổi bằng mực, khả năng cao là hàng dựng lại.',
        ],
        quote:
          'Nguyên tắc của shop: bất kỳ quả nào không qua được cả ba bước trên đều bị loại, dù giá nhập có rẻ đến đâu.',
      },
      {
        heading: 'Kết luận',
        paragraphs: [
          'Ba bước trên xử lý được khoảng 90% trường hợp. Với những món giá trị cao, bạn nên mua ở nơi có ảnh thực tế và video đóng gói — đó là lý do TD Bakugan luôn quay video cho mọi đơn hàng trên 1 triệu đồng.',
        ],
      },
    ],
  },
  {
    id: 'post-002',
    slug: 'g-power-la-gi-va-co-quan-trong-khong',
    title: 'G-Power là gì và có thực sự quan trọng khi sưu tầm không?',
    excerpt:
      'Nhiều người mới nghĩ G-Power càng cao càng tốt. Sự thật phức tạp hơn một chút, đặc biệt khi bạn mua để trưng bày thay vì để đấu.',
    coverImage: blogPlaceholder('G-Power la gi', 1),
    category: 'Hướng dẫn',
    tags: ['g-power', 'người mới', 'sưu tầm'],
    authorName: 'Minh Khôi',
    publishedAt: daysAgo(9),
    readingMinutes: 6,
    viewCount: 3_140,
    sections: [
      {
        paragraphs: [
          'G-Power là chỉ số sức mạnh in trên thân mỗi quả Bakugan, dùng để so sánh khi hai người chơi đối đầu. Quả nào có tổng G-Power cao hơn sau khi cộng thẻ năng lực sẽ thắng vòng đó.',
        ],
      },
      {
        heading: 'Khi nào G-Power thực sự quan trọng',
        paragraphs: [
          'Nếu bạn chơi đấu thật với bạn bè, G-Power quyết định trực tiếp kết quả. Các mẫu trên 1000G của dòng Mechtanium Surge gần như luôn thắng các mẫu Battle Brawlers đời đầu.',
        ],
        bullets: [
          'Chơi đấu: G-Power là yếu tố số một.',
          'Sưu tầm trưng bày: độ hiếm và tình trạng quan trọng hơn nhiều.',
          'Đầu tư giữ giá: ưu tiên hàng nguyên seal, bất kể G-Power.',
        ],
      },
      {
        heading: 'Khi nào nên bỏ qua G-Power',
        paragraphs: [
          'Một quả Hydranoid 940G nguyên hộp đời 2008 có giá cao hơn nhiều so với một quả Battle Planet 560G mới cứng, dù chỉ số thấp hơn. Với người sưu tầm, câu chuyện phía sau món đồ mới là thứ định giá.',
        ],
        quote: 'Người chơi mua sức mạnh. Người sưu tầm mua ký ức.',
      },
    ],
  },
  {
    id: 'post-003',
    slug: 'kinh-nghiem-tham-gia-dau-gia-bakugan',
    title: 'Kinh nghiệm tham gia đấu giá Bakugan: đừng đặt giá trong 30 giây cuối',
    excerpt:
      'Chiến thuật đặt giá, cách đọc lịch sử bid và những sai lầm khiến người mới trả cao hơn giá thị trường 30%.',
    coverImage: blogPlaceholder('Kinh nghiem dau gia', 2),
    category: 'Đấu giá',
    tags: ['đấu giá', 'chiến thuật', 'mẹo'],
    authorName: 'Gia Bảo',
    publishedAt: daysAgo(15),
    readingMinutes: 8,
    viewCount: 5_960,
    sections: [
      {
        paragraphs: [
          'Sàn đấu giá của TD Bakugan mở mỗi tuần vài phiên, và lần nào cũng có người mới trả vượt giá thị trường chỉ vì hồi hộp. Dưới đây là vài nguyên tắc giúp bạn giữ được cái đầu lạnh.',
        ],
      },
      {
        heading: 'Đặt trần giá trước khi phiên bắt đầu',
        paragraphs: [
          'Trước khi phiên mở, hãy tra giá bán lẻ của món tương đương rồi tự đặt một mức trần. Ghi ra giấy. Khi phiên nóng lên, con số đó là thứ duy nhất giữ bạn lại.',
        ],
      },
      {
        heading: 'Đọc lịch sử đặt giá',
        paragraphs: [
          'Lịch sử bid cho biết có bao nhiêu người thực sự quan tâm. Nếu 20 lượt bid chỉ đến từ 2 tài khoản, đó là cuộc đua tay đôi và giá sẽ hạ nhiệt nhanh khi một bên bỏ cuộc.',
        ],
        bullets: [
          'Nhiều người đặt rải rác: món đang hot thật.',
          'Hai tài khoản thay nhau: cuộc đua cá nhân, đừng nhảy vào.',
          'Không ai bid trong 12 giờ đầu: khả năng cao bạn mua được gần giá khởi điểm.',
        ],
      },
      {
        heading: 'Sai lầm kinh điển: bid phút chót',
        paragraphs: [
          'Nhiều người đợi đến 30 giây cuối mới đặt giá, tin rằng đối thủ không kịp phản ứng. Thực tế mạng chậm hoặc thao tác lỗi khiến bạn mất luôn phiên. Hãy đặt mức trần của mình sớm và để hệ thống làm việc.',
        ],
        quote: 'Phiên đấu giá không thưởng cho người nhanh tay nhất, mà cho người kiên nhẫn nhất.',
      },
    ],
  },
  {
    id: 'post-004',
    slug: 'top-6-bakugan-hiem-nhat-tai-viet-nam',
    title: 'Top 6 Bakugan hiếm nhất từng xuất hiện tại thị trường Việt Nam',
    excerpt:
      'Từ Titanium Dragonoid mạ vàng đến trọn bộ Geogan Rising — điểm danh những món mà dân sưu tầm trong nước phải chờ nhiều năm mới gặp.',
    coverImage: blogPlaceholder('Top 6 Bakugan hiem', 3),
    category: 'Sưu tầm',
    tags: ['hàng hiếm', 'sưu tầm', 'định giá'],
    authorName: 'TD Bakugan Team',
    publishedAt: daysAgo(22),
    readingMinutes: 10,
    viewCount: 8_730,
    sections: [
      {
        paragraphs: [
          'Sau hơn bốn năm nhập hàng, đội ngũ shop đã cầm trên tay không ít món mà cộng đồng gọi là "hàng trong truyền thuyết". Danh sách dưới đây xếp theo độ khó tìm tại Việt Nam, không phải theo giá.',
        ],
      },
      {
        heading: '1. Titanium Dragonoid bản mạ vàng',
        paragraphs: [
          'Số lượng sản xuất giới hạn, phần lớn nằm trong tay nhà sưu tầm Bắc Mỹ. Shop mới chỉ nhập được hai quả trong bốn năm, cả hai đều bán qua đấu giá.',
        ],
      },
      {
        heading: '2. Trọn bộ Geogan Rising đủ sáu hệ',
        paragraphs: [
          'Dòng Geogan Rising phát hành muộn và gần như không có kênh phân phối chính thức tại Việt Nam. Gom đủ sáu hệ là bài toán của sự kiên nhẫn.',
        ],
      },
      {
        heading: '3. Hydranoid tam đầu nguyên hộp 2008',
        paragraphs: [
          'Hộp giấy đời đầu rất khó giữ nguyên vẹn sau gần hai thập kỷ. Một chiếc hộp còn tem và góc sắc có thể đội giá món đồ lên gấp đôi.',
        ],
      },
      {
        heading: '4. Wolfurio kèm Mechtogan nguyên seal',
        paragraphs: [
          'Bộ đôi này thường bị tách ra bán lẻ, nên gặp được bản còn đủ cả hai trong một hộp là chuyện hiếm.',
        ],
      },
      {
        heading: '5. Linehalt kèm trọn bộ ba BakuNano',
        paragraphs: [
          'BakuNano nhỏ và dễ thất lạc. Đủ ba món đi kèm đúng quả gốc là điều kiện gần như không thể với hàng đã qua sử dụng.',
        ],
      },
      {
        heading: '6. Combo Ventus đủ series',
        paragraphs: [
          'Không quý hiếm theo nghĩa từng món, nhưng gom đủ một hệ trải dài sáu dòng sản phẩm đòi hỏi nhiều năm theo dõi thị trường.',
        ],
      },
    ],
  },
  {
    id: 'post-005',
    slug: 'huong-dan-bao-quan-bakugan-lau-dai',
    title: 'Hướng dẫn bảo quản Bakugan: giữ nam châm khoẻ và nhựa không ố vàng',
    excerpt:
      'Độ ẩm cao ở Việt Nam là kẻ thù số một của bộ sưu tập. Vài thói quen đơn giản giúp món đồ của bạn giữ giá sau mười năm.',
    coverImage: blogPlaceholder('Bao quan Bakugan', 4),
    category: 'Hướng dẫn',
    tags: ['bảo quản', 'mẹo', 'sưu tầm'],
    authorName: 'Thu Hà',
    publishedAt: daysAgo(31),
    readingMinutes: 5,
    viewCount: 2_410,
    sections: [
      {
        paragraphs: [
          'Khí hậu nóng ẩm khiến nhựa ABS dễ ố vàng và nam châm dễ giảm từ tính. Đây là quy trình bảo quản mà shop áp dụng cho toàn bộ hàng trưng bày.',
        ],
      },
      {
        heading: 'Tránh ánh nắng trực tiếp',
        paragraphs: [
          'Tia UV là nguyên nhân chính làm nhựa trắng chuyển vàng. Tủ kính nên đặt xa cửa sổ, hoặc dùng kính chống UV nếu bạn muốn trưng gần ban công.',
        ],
      },
      {
        heading: 'Giữ độ ẩm dưới 60%',
        paragraphs: [
          'Một hộp hút ẩm silica gel trong tủ trưng bày là đủ cho bộ sưu tập vừa. Thay gói hút ẩm mỗi ba tháng.',
        ],
        bullets: [
          'Không cất trong túi nylon kín — hơi nước đọng lại gây ăn mòn nam châm.',
          'Không lau bằng cồn — dễ làm bay lớp sơn nhũ.',
          'Dùng cọ mềm để phủi bụi ở khe bung nở.',
        ],
      },
      {
        heading: 'Cho cơ cấu "vận động" định kỳ',
        paragraphs: [
          'Mỗi vài tháng nên bung nở vài lần để lò xo không bị lười. Đây là mẹo ít người biết nhưng tạo khác biệt rõ sau nhiều năm.',
        ],
      },
    ],
  },
  {
    id: 'post-006',
    slug: 'td-bakugan-mo-ban-lo-hang-geogan-rising',
    title: 'TD Bakugan mở bán lô Geogan Rising nhập trực tiếp tháng này',
    excerpt:
      'Lô hàng 40 sản phẩm thuộc dòng Geogan Rising đã về kho, trong đó có bốn mẫu lần đầu xuất hiện tại shop.',
    coverImage: blogPlaceholder('Lo hang Geogan Rising', 5),
    category: 'Tin shop',
    tags: ['tin shop', 'hàng mới', 'geogan rising'],
    authorName: 'TD Bakugan Team',
    publishedAt: daysAgo(1),
    readingMinutes: 4,
    viewCount: 1_280,
    sections: [
      {
        paragraphs: [
          'Sau gần ba tháng chờ đợi, lô Geogan Rising nhập trực tiếp đã hoàn tất thủ tục và về tới kho TP.HCM. Toàn bộ 40 sản phẩm đã qua kiểm tra cơ cấu bung nở và chụp ảnh thực tế.',
        ],
      },
      {
        heading: 'Bốn mẫu lần đầu có mặt tại shop',
        paragraphs: [
          'Trong lô này có Lupitheon, Mantonoid, Barbetra và Gillator — bốn cái tên mà cộng đồng hỏi nhiều nhất trong nửa năm qua.',
        ],
        bullets: [
          'Lupitheon Ánh Nguyệt — hệ Haos, 940G',
          'Mantonoid Song Đao Gió — hệ Ventus, 910G',
          'Barbetra Pháo Đài Đất — hệ Subterra, 1000G',
          'Gillator Hàm Cá Sấu — hệ Darkus, 890G',
        ],
      },
      {
        heading: 'Ưu đãi mở bán',
        paragraphs: [
          'Trong tuần đầu tiên, khách đặt từ hai sản phẩm trở lên được miễn phí vận chuyển toàn quốc và tặng kèm túi chống sốc chuyên dụng.',
        ],
        quote:
          'Một quả Lupitheon sẽ được đưa lên sàn đấu giá thay vì bán lẻ — theo dõi trang Đấu giá để không bỏ lỡ.',
      },
    ],
  },
];
