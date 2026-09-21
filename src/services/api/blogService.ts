import type { ApiResponse, BlogPost, Paginated } from '@/types';
import { MOCK_BLOG_POSTS } from '@/mocks';
import { normalizeSearch } from '@/utils/slugify';
import { apiClient, mockDelay, MockApiError, USE_MOCK } from './client';

export interface BlogQuery {
  keyword?: string;
  category?: string;
  tag?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchBlogPosts(query: BlogQuery = {}): Promise<Paginated<BlogPost>> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<Paginated<BlogPost>>>('/blog', {
      params: query,
    });
    return data.data;
  }

  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize ?? 6;
  const needle = query.keyword ? normalizeSearch(query.keyword) : '';

  const filtered = MOCK_BLOG_POSTS.filter((post) => {
    if (query.category && post.category !== query.category) return false;
    if (query.tag && !post.tags.includes(query.tag)) return false;
    if (needle) {
      const haystack = normalizeSearch(`${post.title} ${post.excerpt} ${post.tags.join(' ')}`);
      if (!haystack.includes(needle)) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  return mockDelay({
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  });
}

export async function fetchBlogPostBySlug(slug: string): Promise<BlogPost> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<BlogPost>>(`/blog/${slug}`);
    return data.data;
  }
  const post = MOCK_BLOG_POSTS.find((item) => item.slug === slug);
  if (!post) throw new MockApiError('Không tìm thấy bài viết này.', 404);
  return mockDelay(post);
}

export async function fetchLatestPosts(limit = 3): Promise<BlogPost[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<BlogPost[]>>('/blog/latest', {
      params: { limit },
    });
    return data.data;
  }
  return mockDelay(
    [...MOCK_BLOG_POSTS]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit),
    240,
  );
}

export async function fetchRelatedPosts(slug: string, limit = 3): Promise<BlogPost[]> {
  if (!USE_MOCK) {
    const { data } = await apiClient.get<ApiResponse<BlogPost[]>>(`/blog/${slug}/related`, {
      params: { limit },
    });
    return data.data;
  }
  const current = MOCK_BLOG_POSTS.find((item) => item.slug === slug);
  if (!current) return mockDelay([], 200);
  return mockDelay(
    MOCK_BLOG_POSTS.filter(
      (post) =>
        post.id !== current.id &&
        (post.category === current.category || post.tags.some((tag) => current.tags.includes(tag))),
    ).slice(0, limit),
    220,
  );
}
