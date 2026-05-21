import { useState } from "react";
import { Lock, Mail, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.jpeg";

export function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message);
    } else {
      toast.success("Connexion réussie");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Mot de passe : 6 caractères minimum");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Compte créé. Vous pouvez vous connecter.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-20 h-20 rounded-full overflow-hidden shadow-lg">
            <img src={logo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Gestion de Stock Maarif</h1>
          <p className="text-sm text-muted-foreground">Connectez-vous à votre espace</p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4 mt-4 bg-card p-5 rounded-lg border">
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="vous@exemple.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                <LogIn className="h-4 w-4 mr-2" /> Se connecter
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
