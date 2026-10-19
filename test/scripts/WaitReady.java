import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class WaitReady {
    public static void main(String[] args) throws Exception {
        String[] urls = args[0].split(",");
        long timeoutMs = Long.parseLong(args[1]);
        HttpClient hc = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < timeoutMs) {
            boolean all = true;
            StringBuilder status = new StringBuilder();
            for (String u : urls) {
                try {
                    HttpResponse<String> r = hc.send(
                            HttpRequest.newBuilder(URI.create(u)).timeout(Duration.ofSeconds(5)).GET().build(),
                            HttpResponse.BodyHandlers.ofString());
                    status.append(u.split("//")[1].split("/")[0]).append("=").append(r.statusCode()).append(" ");
                    if (r.statusCode() != 200) all = false;
                } catch (Exception e) {
                    status.append(u.split("//")[1].split("/")[0]).append("=DOWN ");
                    all = false;
                }
            }
            System.out.println("[wait] " + status + " elapsed=" + ((System.currentTimeMillis() - start) / 1000) + "s");
            if (all) { System.out.println("ALL_READY"); return; }
            Thread.sleep(3000);
        }
        System.out.println("TIMEOUT_NOT_READY");
        System.exit(2);
    }
}