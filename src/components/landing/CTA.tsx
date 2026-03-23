import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Calendar, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

export function CTA() {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <Card className="bg-gradient-forest p-12 text-center">
          <h2 className="text-4xl font-bold text-primary-foreground mb-4">
            Ready to Start Your Adventure?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Join Arrow-Park Ventures and unlock powerful business management tools for your organization
          </p>
          
          <div className="flex flex-col md:flex-row gap-6 justify-center">
            <Link to="/book">
              <Button variant="sunset" size="lg" className="group">
                <Calendar className="mr-2" />
                Book a Program
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/contact">
              <Button 
                variant="outline" 
                size="lg"
                className="bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/20"
              >
                <MessageSquare className="mr-2" />
                Ask a Question
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
}