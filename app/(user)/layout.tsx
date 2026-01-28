import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UserNav from "@/components/user-nav";

/**
 * ユーザー画面用レイアウト
 * 認証済みユーザーのみアクセス可能
 */
export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ユーザープロフィールを取得
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // プロフィールがない場合はログアウト
    await supabase.auth.signOut();
    redirect("/login");
  }

  // 無効ユーザーの場合はログアウト
  const profileTyped = profile as { is_active: boolean; left_date?: string | null; [key: string]: any };
  if (!profileTyped.is_active) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  // 退職日が設定されていて、かつ過去の日付の場合はログアウト
  if (profileTyped.left_date) {
    const leftDate = new Date(profileTyped.left_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    leftDate.setHours(0, 0, 0, 0);

    if (leftDate < today) {
      // 仕様: アクセス制御は is_active を正とし、left_date は情報扱い（過去でも即ログアウトしない）
      // ※過去 left_date でも is_active=true のユーザーが存在するケース（データ移行・誤設定等）でログイン不能になるのを防ぐ
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50">
      <UserNav profile={profile as any} />
      <main className="container mx-auto px-4 pt-0 pb-24 max-w-4xl">
        {children}
      </main>
    </div>
  );
}
